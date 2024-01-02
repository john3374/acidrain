'user client';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import { useRef, useState } from 'react';
import Popup from 'reactjs-popup';

const ButtonLogin = () => {
  const { data: session, status, update } = useSession();
  const inputRef = useRef();
  const [nickErr, setNickErr] = useState();

  const resetClose = close => {
    setNickErr('');
    close();
  };

  if (status === 'authenticated') {
    // <Link href="/api/auth/signout" target="_blank">    Sign out    </Link>
    // onClick={e => {      e.preventDefault();      signIn('google');    }}
    return (
      <>
        <Popup
          trigger={
            <button className="profile button">
              <Image src={session.user.image} alt="player image" width={16} height={16} className="circle" />
              {` ${session.user.nickname || '사용자'}`}
            </button>
          }
          modal
          nested
        >
          {close => (
            <div className="modal">
              <div className="content">
                <form
                  onSubmit={async e => {
                    e.preventDefault();
                    const nickname = inputRef.current.value;
                    if (nickname === session.user.nickname) {
                      resetClose(close);
                      return;
                    }
                    if (nickname.length > 7) setNickErr('별명은 최대 7글자 입니다.');
                    const res = await fetch('/api/player/checkNickname', {
                      method: 'POST',
                      body: JSON.stringify({ nickname }),
                    });
                    const { result } = await res.json();
                    if (result) {
                      update({ nickname });
                      resetClose(close);
                    } else setNickErr('이미 사용중인 별명입니다.');
                  }}
                >
                  <div>
                    별명
                    <input ref={inputRef} defaultValue={session.user.nickname} maxLength={7} />
                  </div>
                  <p className="nick-error">{nickErr}</p>
                  <div className="modal-button">
                    <button type="submit" className="button">
                      수정
                    </button>
                    <button type="reset" className="button" onClick={() => resetClose(close)}>
                      취소
                    </button>
                    <button className="button" onClick={() => signOut()}>
                      로그아웃
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </Popup>
        <button
          className="button quit"
          onClick={e => {
            e.preventDefault();
            socket.emit('state', 'gameover');
          }}
        >
          X
        </button>
      </>
    );
  }
  return (
    <button
      className="button"
      onClick={e => {
        e.preventDefault();
        signIn();
      }}
    >
      로그인
    </button>
  );
};

export default ButtonLogin;
